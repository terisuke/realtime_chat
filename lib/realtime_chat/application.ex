defmodule RealtimeChat.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      RealtimeChatWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:realtime_chat, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: RealtimeChat.PubSub},
      {Finch, name: RealtimeChat.Finch},
      {RealtimeChat.MessageStore, []},
      RealtimeChatWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: RealtimeChat.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    RealtimeChatWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
