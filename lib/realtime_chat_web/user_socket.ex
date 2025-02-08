# lib/realtime_chat_web/user_socket.ex
defmodule RealtimeChatWeb.UserSocket do
  use Phoenix.Socket

  # "chat:lobby"というトピックで接続されたら、ChatChannelを使う
  channel "chat:lobby", RealtimeChatWeb.ChatChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    # ここで認証チェックなどを行うこともできる
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
