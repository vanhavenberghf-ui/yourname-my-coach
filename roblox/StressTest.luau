--[[
	StressTest.luau
	Sent by the Discord bot (/playtest) to Roblox Open Cloud "Luau Execution".
	It runs inside a real, headless server of your published place and tries to
	break things, then returns a JSON report the bot turns into feedback.

	The bot prepends:  local INTENSITY = "light" | "normal" | "brutal"

	Note: this runs against your LIVE universe (same DataStores etc.).
	Module fuzzing skips functions whose names look like they touch saved data,
	purchases or bans. Rename/extend UNSAFE_NAME_PATTERNS if your game needs it.
]]

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local Stats = game:GetService("Stats")
local ScriptContext = game:GetService("ScriptContext")

local INTENSITY = INTENSITY or "normal"
local PART_COUNT = ({ light = 250, normal = 750, brutal = 2500 })[INTENSITY] or 750
local FUZZ_ROUNDS = ({ light = 1, normal = 3, brutal = 8 })[INTENSITY] or 3

local UNSAFE_NAME_PATTERNS = {
	"save", "data", "store", "purchase", "receipt", "buy", "ban", "kick",
	"delete", "remove", "wipe", "reset", "give", "grant", "teleport", "shutdown",
}
local SUSPICIOUS_REMOTE_PATTERNS = {
	"money", "cash", "coin", "gem", "give", "admin", "setstat", "addstat",
	"damage", "kill", "teleport", "level", "xp", "unlock", "reward",
}

local report = {
	intensity = INTENSITY,
	errors = {},
	warnings = {},
	issues = {},
	stats = {},
}

local function issue(severity, title, detail)
	table.insert(report.issues, { severity = severity, title = title, detail = detail })
end

local function matchesAny(name, patterns)
	local lower = string.lower(name)
	for _, p in ipairs(patterns) do
		if string.find(lower, p, 1, true) then
			return true
		end
	end
	return false
end

-- Capture every script error that happens while we poke the game.
local errorConn = ScriptContext.Error:Connect(function(message, trace, scriptInst)
	if #report.errors < 25 then
		table.insert(report.errors, {
			message = tostring(message),
			script = scriptInst and scriptInst:GetFullName() or "?",
			trace = string.sub(tostring(trace), 1, 300),
		})
	end
end)

local function measureFrames(seconds)
	local times = {}
	local conn = RunService.Heartbeat:Connect(function(dt)
		table.insert(times, dt)
	end)
	task.wait(seconds)
	conn:Disconnect()
	local total, worst = 0, 0
	for _, dt in ipairs(times) do
		total += dt
		worst = math.max(worst, dt)
	end
	local avg = #times > 0 and total / #times or 0
	return {
		fps = avg > 0 and math.floor(1 / avg + 0.5) or 0,
		avgMs = math.floor(avg * 10000) / 10,
		worstMs = math.floor(worst * 10000) / 10,
	}
end

-- 1. Baseline ---------------------------------------------------------------
task.wait(2) -- let the server's own scripts start up
local memStart = Stats:GetTotalMemoryUsageMb()
report.stats.memoryStartMb = math.floor(memStart)
report.stats.instanceCount = #game:GetDescendants()
report.stats.baseline = measureFrames(3)

-- 2. Map sanity -------------------------------------------------------------
local parts, unanchored, spawns, fallen = 0, 0, 0, 0
local destroyHeight = workspace.FallenPartsDestroyHeight
for _, d in ipairs(workspace:GetDescendants()) do
	if d:IsA("BasePart") then
		parts += 1
		if not d.Anchored then
			unanchored += 1
		end
		if d.Position.Y < destroyHeight + 50 then
			fallen += 1
		end
	end
	if d:IsA("SpawnLocation") then
		spawns += 1
	end
end
report.stats.parts = parts
report.stats.unanchoredParts = unanchored

if spawns == 0 then
	issue("medium", "No SpawnLocation", "Players will spawn at the origin, possibly inside geometry.")
end
if fallen > 0 then
	issue("low", "Parts near the void", fallen .. " parts sit near FallenPartsDestroyHeight and may get deleted.")
end
if parts > 20000 then
	issue("medium", "Very high part count", parts .. " parts in Workspace; mobile players may lag. Consider StreamingEnabled / meshes.")
end
if unanchored > 500 then
	issue("medium", "Many unanchored parts", unanchored .. " unanchored parts cost physics time every frame.")
end
if not workspace.StreamingEnabled and parts > 5000 then
	issue("low", "StreamingEnabled is off", "Large map without streaming = long join times on weak devices.")
end

-- 3. Remote security audit --------------------------------------------------
local remotes = {}
for _, d in ipairs(game:GetDescendants()) do
	if d:IsA("RemoteEvent") or d:IsA("RemoteFunction") or d:IsA("UnreliableRemoteEvent") then
		table.insert(remotes, d)
		if matchesAny(d.Name, SUSPICIOUS_REMOTE_PATTERNS) then
			issue(
				"high",
				"Exploitable-looking remote: " .. d:GetFullName(),
				"Exploiters can fire this with any arguments. Make sure the server validates amounts, cooldowns and ownership instead of trusting the client."
			)
		end
	end
end
report.stats.remotes = #remotes

-- 4. Module fuzzing: call module functions with garbage input ---------------
local JUNK = {
	false, 0, -1, -math.huge, math.huge, 0 / 0, 1e308, "", string.rep("A", 10000),
	"'; DROP TABLE --", {}, { 1, 2, { nested = true } }, true, Vector3.new(1e9, -1e9, 0 / 0),
	workspace, function() end,
}

local fuzzed, fuzzCrashes, requireFails, hangs = 0, 0, 0, 0
local containers = {
	game:GetService("ServerScriptService"),
	game:GetService("ReplicatedStorage"),
	game:GetService("ServerStorage"),
}

local function callWithTimeout(fn, ...)
	local done, ok, err = false, true, nil
	local args = table.pack(...)
	task.spawn(function()
		ok, err = pcall(fn, table.unpack(args, 1, args.n))
		done = true
	end)
	local t = 0
	while not done and t < 2 do
		t += task.wait(0.05)
	end
	return done, ok, err
end

for _, container in ipairs(containers) do
	for _, mod in ipairs(container:GetDescendants()) do
		if mod:IsA("ModuleScript") and not matchesAny(mod.Name, UNSAFE_NAME_PATTERNS) then
			local loaded, okReq, lib = callWithTimeout(require, mod)
			if not loaded then
				hangs += 1
				issue("medium", "Module hangs on require: " .. mod:GetFullName(), "require() did not return within 2s.")
			elseif not okReq then
				requireFails += 1
				issue("high", "Module errors on require: " .. mod:GetFullName(), tostring(lib))
			elseif type(lib) == "table" then
				for name, fn in pairs(lib) do
					if type(fn) == "function" and type(name) == "string" and not matchesAny(name, UNSAFE_NAME_PATTERNS) then
						for _ = 1, FUZZ_ROUNDS do
							local a = JUNK[math.random(1, #JUNK)]
							local b = JUNK[math.random(1, #JUNK)]
							fuzzed += 1
							local finished, okCall, err = callWithTimeout(fn, a, b)
							if not finished then
								hangs += 1
								issue("medium", "Hang: " .. mod.Name .. "." .. name, "Did not return within 2s on junk input.")
								break
							elseif not okCall then
								fuzzCrashes += 1
								if fuzzCrashes <= 15 then
									issue(
										"low",
										"Crash on bad input: " .. mod.Name .. "." .. name,
										string.sub(tostring(err), 1, 200)
									)
								end
								break
							end
						end
					end
				end
			end
		end
	end
end
report.stats.functionsFuzzed = fuzzed
report.stats.fuzzCrashes = fuzzCrashes
report.stats.moduleRequireFails = requireFails
report.stats.hangs = hangs

-- 5. Physics stress test ----------------------------------------------------
local folder = Instance.new("Folder")
folder.Name = "__BotStressTest"
folder.Parent = workspace
for i = 1, PART_COUNT do
	local p = Instance.new("Part")
	p.Size = Vector3.new(2, 2, 2)
	p.Position = Vector3.new((i % 25) * 3, 200 + math.floor(i / 625) * 3, (math.floor(i / 25) % 25) * 3)
	p.Parent = folder
end
report.stats.stress = measureFrames(5)
report.stats.stress.parts = PART_COUNT
folder:Destroy()

if report.stats.stress.fps < 30 then
	issue("high", "Server lags under load", ("Server dropped to %d FPS with %d extra physics parts."):format(report.stats.stress.fps, PART_COUNT))
elseif report.stats.stress.fps < 50 then
	issue("medium", "Server slows under load", ("Server dropped to %d FPS with %d extra physics parts."):format(report.stats.stress.fps, PART_COUNT))
end

-- 6. Leak check -------------------------------------------------------------
task.wait(3)
report.stats.after = measureFrames(2)
local memEnd = Stats:GetTotalMemoryUsageMb()
report.stats.memoryEndMb = math.floor(memEnd)
report.stats.memoryGrowthMb = math.floor(memEnd - memStart)
if memEnd - memStart > 150 then
	issue("medium", "Memory did not recover", ("Memory grew by %d MB during the test and stayed high - possible leak."):format(memEnd - memStart))
end
if report.stats.baseline.fps > 0 and report.stats.baseline.fps < 55 then
	issue("medium", "Low idle server FPS", "Server runs at " .. report.stats.baseline.fps .. " FPS with no players - check heavy loops in server scripts.")
end

errorConn:Disconnect()
if #report.errors > 0 then
	issue("high", #report.errors .. " script error(s) during test", "See the errors list - these are real bugs that fired while the bot poked the game.")
end

return HttpService:JSONEncode(report)
