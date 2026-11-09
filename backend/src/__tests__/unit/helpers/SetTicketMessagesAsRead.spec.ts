jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
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

import Message from "../../../models/Message";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

const mockedMessage = Message as unknown as { update: jest.Mock };
const mockedGetTicketWbot = GetTicketWbot as unknown as jest.Mock;
const mockedShowTicketService = ShowTicketService as unknown as jest.Mock;
const mockedSocketEmit = socketEmit as unknown as jest.Mock;
const mockedGetMessengerBot = getMessengerBot as unknown as jest.Mock;
const mockedStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as unknown as jest.Mock;
const mockedLogger = logger as unknown as { warn: jest.Mock };

const buildTicket = (overrides = {}) =>
  ({
    id: 123,
    tenantId: 4,
    whatsappId: 9,
    channel: "whatsapp",
    isGroup: false,
    contact: {
      number: "5511999999999",
      messengerId: "messenger-contact"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedMessage.update.mockResolvedValue([1]);
    mockedShowTicketService.mockResolvedValue({
      id: 123,
      unreadMessages: 0
    });
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marca mensagens do ticket como lidas, zera contador e emite atualizacao", async () => {
    const ticket = buildTicket();
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    mockedGetTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(mockedMessage.update).toHaveBeenCalledWith(
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
    expect(mockedShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 4
    });
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: 4,
      type: "ticket:update",
      payload: {
        id: 123,
        unreadMessages: 0
      }
    });
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("aciona verificacao de sessao quando sendSeen rejeita", async () => {
    const sendSeenError = new Error(
      "Cannot read property 'sendSeen' of undefined"
    );
    const ticket = buildTicket();
    mockedGetTicketWbot.mockResolvedValue({
      sendSeen: jest.fn().mockRejectedValue(sendSeenError)
    });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      9,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockedSocketEmit).toHaveBeenCalled();
  });

  it("marca leitura no Messenger quando o ticket e desse canal", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({
      channel: "messenger"
    });
    mockedGetMessengerBot.mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(mockedGetTicketWbot).not.toHaveBeenCalled();
    expect(mockedGetMessengerBot).toHaveBeenCalledWith(9);
    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(mockedSocketEmit).toHaveBeenCalled();
  });

  it("mantem atualizacao do ticket mesmo quando marcar como lido no canal falha", async () => {
    const ticket = buildTicket();
    const getWbotError = new Error("ERR_WAPP_NOT_INITIALIZED");
    mockedGetTicketWbot.mockRejectedValue(getWbotError);

    await SetTicketMessagesAsRead(ticket);

    expect(mockedLogger.warn).toHaveBeenCalledWith(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${getWbotError}`
    );
    expect(mockedShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 4
    });
    expect(mockedSocketEmit).toHaveBeenCalled();
  });
});
