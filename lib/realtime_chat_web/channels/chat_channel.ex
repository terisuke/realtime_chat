defmodule RealtimeChatWeb.ChatChannel do
  use RealtimeChatWeb, :channel

  alias RealtimeChat.MessageStore

  @impl true
  def join("chat:lobby", _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    all_messages = MessageStore.get_messages()
    push(socket, "load_messages", %{messages: Enum.reverse(all_messages)})
    {:noreply, socket}
  end

  @impl true
  def handle_in("new_message", %{"message" => message, "reply_to" => reply_to}, socket) do
    msg = MessageStore.add_message(message, reply_to)
    broadcast!(socket, "new_message", %{message: msg})
    {:noreply, socket}
  end

  @impl true
  def handle_in("get_messages", _params, socket) do
    all_messages = MessageStore.get_messages()
    push(socket, "load_messages", %{messages: Enum.reverse(all_messages)})
    {:noreply, socket}
  end

  @impl true
  def handle_in("like_message", %{"message_id" => message_id}, socket)
      when is_binary(message_id) do
    case Integer.parse(message_id) do
      {id, _} ->
        updated_message = MessageStore.add_like(id)
        broadcast!(socket, "message_liked", %{message: updated_message})
        {:reply, :ok, socket}

      _ ->
        {:reply, {:error, %{reason: "invalid message id"}}, socket}
    end
  end

  def handle_in("like_message", %{"message_id" => message_id}, socket)
      when is_integer(message_id) do
    updated_message = MessageStore.add_like(message_id)
    broadcast!(socket, "message_liked", %{message: updated_message})
    {:reply, :ok, socket}
  end
end
