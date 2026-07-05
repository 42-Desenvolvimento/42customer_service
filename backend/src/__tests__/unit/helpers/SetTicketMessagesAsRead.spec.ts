const mockMessageUpdate = jest.fn();
const mockShowTicketService = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLoggerWarn = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockSocketEmit = jest.fn();
const mockGetMessengerBot = jest.fn();

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: mockMessageUpdate
  }
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: mockShowTicketService
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: mockGetTicketWbot
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: mockSocketEmit
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aciona a verificacao da sessao quando o WhatsApp rejeita sendSeen", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticketReload = { id: 23, unreadMessages: 0 };
    const ticket = {
      id: 23,
      tenantId: 5,
      whatsappId: 88,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockMessageUpdate.mockResolvedValue([1]);
    mockGetTicketWbot.mockResolvedValue({ sendSeen });
    mockShowTicketService.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});
