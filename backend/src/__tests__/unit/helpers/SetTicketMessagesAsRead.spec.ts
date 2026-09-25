import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

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
  const getMessengerBotMock = getMessengerBot as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const createTicket = (overrides = {}) =>
    ({
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact"
      },
      update: jest.fn(),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    messageUpdateMock.mockResolvedValue([1]);
    showTicketServiceMock.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marks WhatsApp messages as read and emits the refreshed ticket", async () => {
    const ticket = createTicket();
    const wbot = {
      sendSeen: jest.fn().mockResolvedValue(undefined)
    };
    getTicketWbotMock.mockResolvedValue(wbot);

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
    expect(wbot.sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 10,
      tenantId: 20
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("triggers WhatsApp session verification when sendSeen rejects", async () => {
    const ticket = createTicket();
    const error = new Error("Cannot read property 'sendSeen' of undefined");
    const wbot = {
      sendSeen: jest.fn().mockRejectedValue(error)
    };
    getTicketWbotMock.mockResolvedValue(wbot);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(30, error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("uses Messenger markSeen for messenger tickets", async () => {
    const markSeen = jest.fn();
    const ticket = createTicket({ channel: "messenger" });
    getMessengerBotMock.mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(getTicketWbotMock).not.toHaveBeenCalled();
  });
});
