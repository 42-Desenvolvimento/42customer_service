import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should mark whatsapp messages as read and verify session when sendSeen fails", async () => {
    const error = new Error("Session closed");
    const sendSeen = jest.fn().mockRejectedValue(error);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    const ticket = {
      id: 1,
      tenantId: 2,
      whatsappId: 3,
      channel: "whatsapp",
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
          ticketId: 1,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(3, error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 2,
      type: "ticket:update",
      payload: { id: 1 }
    });
  });

  it("should mark messenger messages as read through the messenger bot", async () => {
    const markSeen = jest.fn();
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });

    const ticket = {
      id: 1,
      tenantId: 2,
      whatsappId: 3,
      channel: "messenger",
      isGroup: false,
      contact: {
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 2,
      type: "ticket:update",
      payload: { id: 1 }
    });
  });
});
