import Config

config :realtime_chat,
  generators: [timestamp_type: :utc_datetime]

config :realtime_chat, RealtimeChatWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: RealtimeChatWeb.ErrorHTML, json: RealtimeChatWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: RealtimeChat.PubSub,
  live_view: [signing_salt: "xW9GEqxo"]

config :realtime_chat, RealtimeChat.Mailer, adapter: Swoosh.Adapters.Local

config :esbuild,
  version: "0.17.11",
  realtime_chat: [
    args:
      ~w(js/app.js --bundle --target=es2017 --outdir=../priv/static/assets --external:/fonts/* --external:/images/*),
    cd: Path.expand("../assets", __DIR__),
    env: %{"NODE_PATH" => Path.expand("../deps", __DIR__)}
  ]

config :tailwind,
  version: "3.4.3",
  realtime_chat: [
    args: ~w(
      --config=tailwind.config.js
      --input=css/app.css
      --output=../priv/static/assets/app.css
    ),
    cd: Path.expand("../assets", __DIR__)
  ]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
