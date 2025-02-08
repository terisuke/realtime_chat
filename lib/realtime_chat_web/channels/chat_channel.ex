# lib/realtime_chat_web/channels/chat_channel.ex
defmodule RealtimeChatWeb.ChatChannel do
  use Phoenix.Channel

  alias RealtimeChat.MessageStore

  @impl true
  def join("chat:lobby", _payload, socket) do
    # 過去のメッセージ一覧を取得して送る(古い→新しい順にしたいならEnum.reverseなど)
    all_messages = MessageStore.get_messages()
    push(socket, "load_messages", %{messages: Enum.reverse(all_messages)})

    {:ok, socket}
  end

  @impl true
  def handle_in("new_message", %{"content" => content}, socket) do
    # 新規メッセージを保存し、戻ってきたレコードを取得
    msg = MessageStore.add_message(content)

    # 全クライアントに通知(broadcast!)
    broadcast!(socket, "new_message", %{message: msg})

    {:noreply, socket}
  end
end
