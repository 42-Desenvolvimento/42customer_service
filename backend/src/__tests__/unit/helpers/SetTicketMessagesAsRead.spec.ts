jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

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
import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import socketEmit from "../../../helpers/socketEmit";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

const makeTicket = (overrides = {}) =>
  ({
    id: 123,
    tenantId: 42,
    channel: "whatsapp",
    whatsappId: 77,
    isGroup: false,
    contact: {
      number: "5511999999999",
      messengerId: "messenger-contact"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("SetTicketMessagesAsRead", () => {
  const messageUpdateMock = Message.update as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const showTicketServiceMock = ShowTicketService as jest.Mock;
  const socketEmitMock = socketEmit as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const loggerWarnMock = logger.warn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    showTicketServiceMock.mockResolvedValue({ id: 123, unreadMessages: 0 });
  });

  it("marks ticket messages as read and emits the refreshed ticket", async () => {
    const ticket = makeTicket();
    const sendSeenMock = jest.fn().mockResolvedValue(undefined);
    getTicketWbotMock.mockResolvedValue({ sendSeen: sendSeenMock });

    await SetTicketMessagesAsRead(ticket);

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeenMock).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });
  });

  it("starts WhatsApp session recovery when sendSeen rejects", async () => {
    const ticket = makeTicket({ whatsappId: 88 });
    const error = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeenMock = jest.fn().mockReturnValue(Promise.reject(error));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getTicketWbotMock.mockResolvedValue({ sendSeen: sendSeenMock });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(socketEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ticket.tenantId,
        type: "ticket:update"
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it("keeps the read-state update when WhatsApp client lookup fails", async () => {
    const ticket = makeTicket();
    const error = new Error("ERR_WAPP_NOT_INITIALIZED");
    getTicketWbotMock.mockRejectedValue(error);

    await SetTicketMessagesAsRead(ticket);

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("Could not mark messages as read")
    );
    expect(socketEmitMock).toHaveBeenCalled();
  });
});
