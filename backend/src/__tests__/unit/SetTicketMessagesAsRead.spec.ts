jest.mock("../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

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
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import socketEmit from "../../helpers/socketEmit";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  const makeTicket = () =>
    ({
      id: 12,
      tenantId: 5,
      channel: "whatsapp",
      whatsappId: 8,
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.update as jest.Mock).mockResolvedValue(undefined);
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 12, unreadMessages: 0 });
  });

  it("marks ticket messages as read and emits the reloaded ticket", async () => {
    const ticket = makeTicket();
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 12,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({ id: 12, tenantId: 5 });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 12, unreadMessages: 0 }
    });
  });

  it("starts WhatsApp session verification when sendSeen rejects without blocking the ticket update", async () => {
    const ticket = makeTicket();
    const sendSeenError = new Error("Session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(8, sendSeenError);
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 12, unreadMessages: 0 }
    });

    consoleError.mockRestore();
  });
});

export {};
