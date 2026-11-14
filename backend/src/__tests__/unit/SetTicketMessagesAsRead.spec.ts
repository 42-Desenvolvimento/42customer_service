jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));
jest.mock("../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));
jest.mock("../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

import Message from "../../models/Message";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session when sendSeen fails asynchronously", async () => {
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 20,
      unreadMessages: 0
    });

    const ticket = {
      id: 20,
      tenantId: 3,
      whatsappId: 88,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5551888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    try {
      await SetTicketMessagesAsRead(ticket as any);
      await Promise.resolve();

      expect(Message.update).toHaveBeenCalledWith(
        { read: true },
        {
          where: {
            ticketId: 20,
            read: false
          }
        }
      );
      expect(sendSeen).toHaveBeenCalledWith("5551888888888@c.us");
      expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
        88,
        sendSeenError
      );
      expect(socketEmit).toHaveBeenCalledWith({
        tenantId: 3,
        type: "ticket:update",
        payload: {
          id: 20,
          unreadMessages: 0
        }
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
