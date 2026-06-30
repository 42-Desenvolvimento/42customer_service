const mockGetMessengerBot = jest.fn();
const mockMessageUpdate = jest.fn();
const mockShowTicketService = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLoggerWarn = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockSocketEmit = jest.fn();

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

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

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  const buildTicket = (overrides = {}) =>
    ({
      id: 10,
      tenantId: 20,
      channel: "whatsapp",
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "55988887777",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeAll(() => {
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageUpdate.mockResolvedValue([1]);
    mockShowTicketService.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marca mensagens como lidas no WhatsApp, zera contador e emite ticket atualizado", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = buildTicket();

    mockGetTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(mockMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("55988887777@c.us");
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 20
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("revalida a sessão quando sendSeen rejeita sem bloquear a atualização do ticket", async () => {
    const error = new Error("session closed");
    const ticket = buildTicket();

    mockGetTicketWbot.mockResolvedValue({
      sendSeen: jest.fn().mockRejectedValue(error)
    });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("usa markSeen para tickets do Messenger", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({ channel: "messenger" });

    mockGetMessengerBot.mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(mockGetTicketWbot).not.toHaveBeenCalled();
  });
});
