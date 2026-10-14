jest.mock("../../models/Message", () => ({ update: jest.fn() }));
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../helpers/socketEmit", () => jest.fn());
jest.mock("../../libs/messengerBot", () => ({ getMessengerBot: jest.fn() }));
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../models/Message";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("starts WhatsApp session verification when sendSeen rejects", async () => {
    const sendSeenError = new Error("Session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 10,
      channel: "whatsapp",
      whatsappId: 77,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      77,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 10
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 10,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});

export {};
