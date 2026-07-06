const mockMessageUpdate = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockShowTicketService = jest.fn();
const mockSocketEmit = jest.fn();
const mockGetMessengerBot = jest.fn();
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve verificar a sessão do WhatsApp quando sendSeen rejeitar", async () => {
    const sendSeenError = new Error("session closed");
    const mockSendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockGetTicketWbot.mockResolvedValue({
      sendSeen: mockSendSeen
    });
    mockShowTicketService.mockResolvedValue({
      id: 15,
      unreadMessages: 0
    });

    const ticket = {
      id: 15,
      tenantId: 7,
      whatsappId: 3,
      channel: "whatsapp",
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
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(mockSendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: {
        id: 15,
        unreadMessages: 0
      }
    });

    consoleErrorSpy.mockRestore();
  });
});
