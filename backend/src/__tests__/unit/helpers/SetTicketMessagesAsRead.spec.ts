const mockMessageUpdate = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockShowTicketService = jest.fn();
const mockSocketEmit = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockGetMessengerBot = jest.fn();
const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: mockMessageUpdate
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: mockGetTicketWbot
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: mockShowTicketService
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: mockSocketEmit
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

jest.mock("../../../utils/logger", () => ({
  logger: mockLogger
}));

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session when sendSeen rejects", async () => {
    const SetTicketMessagesAsRead = require("../../../helpers/SetTicketMessagesAsRead")
      .default;
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 321, unreadMessages: 0 };
    const ticket = {
      id: 321,
      tenantId: 12,
      whatsappId: 34,
      channel: "whatsapp",
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockGetTicketWbot.mockResolvedValue({ sendSeen });
    mockShowTicketService.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 321,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@g.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      34,
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 12,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});

export {};
