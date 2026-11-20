jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../helpers/socketEmit", () => jest.fn());
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

describe("helpers/SetTicketMessagesAsRead", () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("should verify the WhatsApp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session disconnected");
    const ticketReload = { id: 42, unreadMessages: 0 };
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticket = {
      id: 42,
      tenantId: 7,
      whatsappId: 99,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 42,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      99,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
