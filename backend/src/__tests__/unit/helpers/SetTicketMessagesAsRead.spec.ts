import Message from "../../../models/Message";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { getMessengerBot } from "../../../libs/messengerBot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
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

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

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

describe("SetTicketMessagesAsRead", () => {
  const messageUpdateMock = Message.update as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const socketEmitMock = socketEmit as jest.Mock;
  const showTicketServiceMock = ShowTicketService as jest.Mock;
  const getMessengerBotMock = getMessengerBot as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const loggerWarnMock = logger.warn as jest.Mock;

  const makeTicket = (overrides = {}) =>
    ({
      id: 10,
      tenantId: 3,
      channel: "whatsapp",
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact-id"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    messageUpdateMock.mockResolvedValue([2]);
    showTicketServiceMock.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  it("marks unread ticket messages as read and emits the refreshed ticket", async () => {
    const sendSeenMock = jest.fn().mockResolvedValue(undefined);
    const ticket = makeTicket();
    getTicketWbotMock.mockResolvedValue({
      sendSeen: sendSeenMock
    });

    await SetTicketMessagesAsRead(ticket);

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeenMock).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 10,
      tenantId: 3
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("verifies the whatsapp session when sendSeen is rejected", async () => {
    const error = new Error("session closed");
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = makeTicket({ isGroup: true });
    getTicketWbotMock.mockResolvedValue({
      sendSeen: jest.fn().mockRejectedValue(error)
    });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(99, error);
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("marks messenger tickets as seen with the channel session", async () => {
    const markSeenMock = jest.fn();
    const ticket = makeTicket({
      channel: "messenger",
      whatsappId: 42
    });
    getMessengerBotMock.mockReturnValue({
      markSeen: markSeenMock
    });

    await SetTicketMessagesAsRead(ticket);

    expect(getTicketWbotMock).not.toHaveBeenCalled();
    expect(getMessengerBotMock).toHaveBeenCalledWith(42);
    expect(markSeenMock).toHaveBeenCalledWith("messenger-contact-id");
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("keeps ticket state synchronized when external mark-as-read fails", async () => {
    const error = new Error("whatsapp disconnected");
    const ticket = makeTicket();
    getTicketWbotMock.mockRejectedValue(error);

    await SetTicketMessagesAsRead(ticket);

    expect(loggerWarnMock).toHaveBeenCalledWith(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${error}`
    );
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 10,
      tenantId: 3
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });
});
