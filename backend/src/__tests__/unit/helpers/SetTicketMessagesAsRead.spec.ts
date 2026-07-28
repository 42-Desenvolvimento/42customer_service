const mockMessageUpdate = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockGetMessengerBot = jest.fn();
const mockShowTicketService = jest.fn();
const mockSocketEmit = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: mockMessageUpdate
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetTicketWbot(...args)
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: (...args: unknown[]) => mockGetMessengerBot(...args)
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockShowTicketService(...args)
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSocketEmit(...args)
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: (...args: unknown[]) =>
    mockStartWhatsAppSessionVerify(...args)
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args)
  }
}));

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageUpdate.mockResolvedValue([1]);
    mockShowTicketService.mockResolvedValue({ id: 123, unreadMessages: 0 });
  });

  it("starts whatsapp session verification when sendSeen fails", async () => {
    const sendSeenError = new Error("session closed");
    const mockSendSeen = jest.fn().mockRejectedValue(sendSeenError);
    mockGetTicketWbot.mockResolvedValue({
      sendSeen: mockSendSeen
    });
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const ticket = {
      id: 123,
      tenantId: 10,
      channel: "whatsapp",
      whatsappId: 77,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(mockMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(mockGetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(mockSendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      77,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 10
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 10,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });

    consoleErrorSpy.mockRestore();
  });
});
