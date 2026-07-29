const mockMessageUpdate = jest.fn();
const mockTicketShow = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockSocketEmit = jest.fn();
const mockGetMessengerBot = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("../../../models/Message", () => ({
  update: mockMessageUpdate
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  mockTicketShow
);

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session when sendSeen rejects without blocking ticket updates", async () => {
    const sendSeenError = new Error("session disconnected");
    const mockSendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 10, status: "open" };
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
    } as any;

    mockGetTicketWbot.mockResolvedValue({
      sendSeen: mockSendSeen
    });
    mockTicketShow.mockResolvedValue(ticketReload);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

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
    expect(mockSendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(mockTicketShow).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});
