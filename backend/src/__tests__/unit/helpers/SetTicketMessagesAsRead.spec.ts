jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../../helpers/socketEmit", () => jest.fn());
jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session when sendSeen rejects after marking local messages as read", async () => {
    const sendSeenError = new Error("session disconnected");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 42,
      channel: "whatsapp",
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    (Message.update as jest.Mock).mockResolvedValue([1]);
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
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(99, sendSeenError);
    expect(ShowTicketService).toHaveBeenCalledWith({ id: 123, tenantId: 42 });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 42,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleErrorSpy.mockRestore();
  });
});
