defmodule RealtimeChatWeb.UserSocket do
  use Phoenix.Socket

  channel "chat:lobby", RealtimeChatWeb.ChatChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
