import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../helpers/socketEmit", () => jest.fn());
jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 10,
      unreadMessages: 0
    });
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("should trigger WhatsApp session verification when sendSeen fails asynchronously", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    const ticket = {
      id: 10,
      tenantId: 3,
      channel: "whatsapp",
      whatsappId: 99,
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
          ticketId: 10,
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
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 3
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: {
        id: 10,
        unreadMessages: 0
      }
    });
  });

  it("should mark messenger messages as seen through the configured bot", async () => {
    const markSeen = jest.fn();
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });
    const ticket = {
      id: 11,
      tenantId: 4,
      channel: "messenger",
      whatsappId: 88,
      contact: {
        messengerId: "mid.123"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);

    expect(markSeen).toHaveBeenCalledWith("mid.123");
    expect(GetTicketWbot).not.toHaveBeenCalled();
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });
});
