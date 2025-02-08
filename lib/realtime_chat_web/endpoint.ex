defmodule RealtimeChatWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :realtime_chat

  @session_options [
    store: :cookie,
    key: "_realtime_chat_key",
    signing_salt: "tEjtrU6+",
    same_site: "Lax"
  ]

  socket "/socket", RealtimeChatWeb.UserSocket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: false

  socket "/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]],
    longpoll: [connect_info: [session: @session_options]]

  plug Plug.Static,
    at: "/",
    from: :realtime_chat,
    gzip: false,
    only: RealtimeChatWeb.static_paths()

  if code_reloading? do
    socket "/phoenix/live_reload/socket", Phoenix.LiveReloader.Socket
    plug Phoenix.LiveReloader
    plug Phoenix.CodeReloader
  end

  plug Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options
  plug RealtimeChatWeb.Router
end
