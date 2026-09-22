jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

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

import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import { getMessengerBot } from "../../../libs/messengerBot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const messageUpdateMock = Message.update as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;
const getMessengerBotMock = getMessengerBot as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

const buildTicket = (overrides = {}) =>
  ({
    id: 123,
    tenantId: 7,
    channel: "whatsapp",
    whatsappId: 44,
    isGroup: false,
    contact: {
      number: "5511999999999",
      messengerId: "messenger-contact-id"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    messageUpdateMock.mockResolvedValue([1]);
    showTicketServiceMock.mockResolvedValue({ id: 123, unreadMessages: 0 });
  });

  it("marks unread messages and notifies the whatsapp client for the ticket contact", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = buildTicket();
    getTicketWbotMock.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(getTicketWbotMock).toHaveBeenCalledWith(ticket);
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 123,
      tenantId: 7
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });
  });

  it("verifies the whatsapp session when sendSeen rejects asynchronously", async () => {
    const error = new Error("session closed");
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sendSeen = jest.fn().mockReturnValue(Promise.reject(error));
    const ticket = buildTicket();
    getTicketWbotMock.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(44, error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });

    consoleErrorSpy.mockRestore();
  });

  it("marks messenger conversations as seen without touching whatsapp sessions", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({
      channel: "messenger",
      whatsappId: 55
    });
    getMessengerBotMock.mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(getMessengerBotMock).toHaveBeenCalledWith(55);
    expect(markSeen).toHaveBeenCalledWith("messenger-contact-id");
    expect(getTicketWbotMock).not.toHaveBeenCalled();
  });
});
