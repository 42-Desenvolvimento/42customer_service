jest.mock("../../models/Message", () => ({
  update: jest.fn()
}));
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../helpers/socketEmit", () => jest.fn());
jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
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
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("verifies the WhatsApp session when marking a ticket as seen fails", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockReturnValue(Promise.reject(sendSeenError));
    const ticket = {
      id: 15,
      tenantId: 3,
      whatsappId: 9,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const ticketReload = { id: ticket.id, unreadMessages: 0 };

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
