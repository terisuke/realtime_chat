import Config

config :realtime_chat, RealtimeChatWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "XKFQ380ShVuF4MXcFV6ZQIlghipQgw5i6n7njaDpIefVoqaXmb7zpb8nY0a4HdtG",
  watchers: [
    esbuild: {Esbuild, :install_and_run, [:realtime_chat, ~w(--sourcemap=inline --watch)]},
    tailwind: {Tailwind, :install_and_run, [:realtime_chat, ~w(--watch)]}
  ]

config :realtime_chat, RealtimeChatWeb.Endpoint,
  live_reload: [
    patterns: [
      ~r"priv/static/(?!uploads/).*(js|css|png|jpeg|jpg|gif|svg)$",
      ~r"priv/gettext/.*(po)$",
      ~r"lib/realtime_chat_web/(controllers|live|components)/.*(ex|heex)$"
    ]
  ]

config :realtime_chat, dev_routes: true

config :logger, :console, format: "[$level] $message\n"

config :phoenix, :stacktrace_depth, 20

config :phoenix, :plug_init_mode, :runtime

config :phoenix_live_view,
  debug_heex_annotations: true,
  enable_expensive_runtime_checks: true

config :swoosh, :api_client, false
