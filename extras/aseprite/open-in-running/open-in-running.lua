-- Opens files aseprite-open drops in the inbox: "<epoch ms>-<nonce>/<absolute path as nested dirs>".
-- Read with app.fs.listFiles only, which skips the script access prompt io.open and app.open raise.

local POLL_SECONDS = 0.25
-- Older requests are leftovers nobody picked up; opening them now would surprise.
local MAX_AGE_MS = 10000

local timer

local function requestPath(dir)
  local path = ""
  local current = dir
  while app.fs.isDirectory(current) do
    local entries = app.fs.listFiles(current)
    if #entries ~= 1 then return nil end
    path = path .. "/" .. entries[1]
    current = app.fs.joinPath(current, entries[1])
  end
  if app.fs.isFile(current) then return path end
  return nil
end

local function openOrFocus(path)
  for _, sprite in ipairs(app.sprites) do
    if sprite.filename == path then
      app.sprite = sprite
      return
    end
  end
  app.command.OpenFile { filename = path }
end

function init(plugin)
  local inbox = app.fs.joinPath(app.fs.userConfigPath, "inbox")
  local seen = {}

  timer = Timer {
    interval = POLL_SECONDS,
    ontick = function()
      if not app.fs.isDirectory(inbox) then return end
      local nowMs = os.time() * 1000
      for _, name in ipairs(app.fs.listFiles(inbox)) do
        local stamp = tonumber(name:match("^(%d+)%-"))
        if stamp and not seen[name] then
          seen[name] = true
          if nowMs - stamp <= MAX_AGE_MS then
            local path = requestPath(app.fs.joinPath(inbox, name))
            if path then openOrFocus(path) end
          end
        end
      end
    end
  }
  timer:start()
end

function exit(plugin)
  if timer then timer:stop() end
end
