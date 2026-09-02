jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  const messageUpdateMock = Message.update as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const showTicketServiceMock = ShowTicketService as jest.Mock;
  const socketEmitMock = socketEmit as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    messageUpdateMock.mockResolvedValue([1]);
    showTicketServiceMock.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  it("verifies the whatsapp session when marking messages as read rejects", async () => {
    const sendSeenError = new Error("sendSeen failed");
    const sendSeenMock = jest.fn().mockRejectedValue(sendSeenError);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    getTicketWbotMock.mockResolvedValue({ sendSeen: sendSeenMock });

    const ticket = {
      id: 10,
      tenantId: 20,
      channel: "whatsapp",
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeenMock).toHaveBeenCalledWith("5511999999999@c.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });

    consoleErrorSpy.mockRestore();
  });
});

export {};
