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

describe("SetTicketMessagesAsRead", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageUpdate.mockResolvedValue([1]);
    mockShowTicketService.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("verifies the WhatsApp session when marking messages as seen fails", async () => {
    const sendSeenError = new Error("Session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    mockGetTicketWbot.mockResolvedValue({ sendSeen });
    const ticket = {
      id: 10,
      tenantId: 5,
      whatsappId: 77,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

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
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledTimes(1);
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      77,
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: {
        id: 10,
        unreadMessages: 0
      }
    });
  });
});
