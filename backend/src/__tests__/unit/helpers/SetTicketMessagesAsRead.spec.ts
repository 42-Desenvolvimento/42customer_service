const mockMessageUpdate = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockShowTicketService = jest.fn();
const mockSocketEmit = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockGetMessengerBot = jest.fn();
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

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn
  }
}));

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

const flushPromises = () =>
  new Promise(resolve => {
    setImmediate(resolve);
  });

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify whatsapp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 10, unreadMessages: 0 };
    const ticket = {
      id: 10,
      tenantId: 2,
      whatsappId: 7,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockGetTicketWbot.mockResolvedValue({ sendSeen });
    mockShowTicketService.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await flushPromises();

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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      7,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 2
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 2,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});

export {};
