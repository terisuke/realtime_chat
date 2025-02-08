import Config

config :realtime_chat, RealtimeChatWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "ltXJiwxnP3X/PyT+zFuhJ+csDWSB5GT3zDmBoDA8Su7hYwwKxzbyUE/7EuFVxYj0",
  server: false

config :realtime_chat, RealtimeChat.Mailer, adapter: Swoosh.Adapters.Test

config :swoosh, :api_client, false

config :logger, level: :warning

config :phoenix, :plug_init_mode, :runtime

config :phoenix_live_view,
  enable_expensive_runtime_checks: true
