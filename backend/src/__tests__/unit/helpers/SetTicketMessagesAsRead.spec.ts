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

import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

const mockedMessageUpdate = Message.update as jest.Mock;
const mockedShowTicketService = ShowTicketService as jest.Mock;
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedSocketEmit = socketEmit as jest.Mock;

const buildTicket = (overrides = {}) =>
  ({
    id: 42,
    tenantId: 3,
    whatsappId: 9,
    channel: "whatsapp",
    isGroup: true,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockedMessageUpdate.mockResolvedValue([1]);
    mockedShowTicketService.mockResolvedValue({ id: 42, unreadMessages: 0 });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marks local WhatsApp messages as read and verifies the session when sendSeen fails", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    mockedGetTicketWbot.mockResolvedValue({ sendSeen });
    const ticket = buildTicket();

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockedMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 42,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@g.us");
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      9,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: { id: 42, unreadMessages: 0 }
    });
  });
});
