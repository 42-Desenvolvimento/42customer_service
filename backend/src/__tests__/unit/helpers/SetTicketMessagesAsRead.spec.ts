const mockMessageUpdate = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockShowTicketService = jest.fn();
const mockSocketEmit = jest.fn();
const mockGetMessengerBot = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("../../../models/Message", () => ({
  update: mockMessageUpdate
}));

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  mockShowTicketService
);

jest.mock("../../../helpers/socketEmit", () => mockSocketEmit);

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn
  }
}));

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should verify whatsapp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 10,
      whatsappId: 99,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockGetTicketWbot.mockResolvedValue({ sendSeen });
    mockShowTicketService.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
