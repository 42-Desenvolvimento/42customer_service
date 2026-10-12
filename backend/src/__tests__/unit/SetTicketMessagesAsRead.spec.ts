import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import { getMessengerBot } from "../../libs/messengerBot";
import Message from "../../models/Message";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 42 });
    (getMessengerBot as jest.Mock).mockReturnValue({
      markSeen: jest.fn()
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("verifies the WhatsApp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    const ticket = {
      id: 42,
      tenantId: 10,
      channel: "whatsapp",
      whatsappId: 77,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);
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
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(77, sendSeenError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.any(String),
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 10,
      type: "ticket:update",
      payload: { id: 42 }
    });
  });
});
