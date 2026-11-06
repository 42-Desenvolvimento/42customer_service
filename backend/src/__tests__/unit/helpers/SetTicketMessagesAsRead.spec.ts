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
  update: jest.fn()
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

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

describe("SetTicketMessagesAsRead", () => {
  const messageUpdateMock = Message.update as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const showTicketServiceMock = ShowTicketService as jest.Mock;
  const socketEmitMock = socketEmit as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const getMessengerBotMock = getMessengerBot as jest.Mock;

  const buildTicket = (overrides = {}) =>
    ({
      id: 123,
      tenantId: 5,
      channel: "whatsapp",
      whatsappId: 9,
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    messageUpdateMock.mockReset();
    getTicketWbotMock.mockReset();
    showTicketServiceMock.mockReset();
    socketEmitMock.mockReset();
    startWhatsAppSessionVerifyMock.mockReset();
    getMessengerBotMock.mockReset();
  });

  it("marks whatsapp messages as read and emits the refreshed ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = buildTicket();

    messageUpdateMock.mockResolvedValue([2]);
    getTicketWbotMock.mockResolvedValue({ sendSeen });
    showTicketServiceMock.mockResolvedValue(ticketReload);

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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 123,
      tenantId: 5
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: ticketReload
    });
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("starts whatsapp session verification when sendSeen rejects", async () => {
    const error = new Error("Cannot read property 'sendSeen' of undefined");
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = buildTicket();

    messageUpdateMock.mockResolvedValue([1]);
    getTicketWbotMock.mockResolvedValue({
      sendSeen: jest.fn().mockRejectedValue(error)
    });
    showTicketServiceMock.mockResolvedValue({ id: 123 });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(9, error);
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 123 }
    });

    consoleErrorSpy.mockRestore();
  });
});
