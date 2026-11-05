jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("verifies the WhatsApp session when marking messages as seen fails asynchronously", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 456,
      whatsappId: 789,
      channel: "whatsapp",
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
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(789, sendSeenError);
    expect(console.error).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 456,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
