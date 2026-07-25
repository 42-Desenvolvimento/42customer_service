const mockMessageUpdate = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockSocketEmit = jest.fn();
const mockShowTicketService = jest.fn();
const mockGetMessengerBot = jest.fn();
const mockLoggerWarn = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("../../../models/Message", () => ({
  update: mockMessageUpdate
}));

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

jest.mock("../../../helpers/socketEmit", () => mockSocketEmit);

jest.mock("../../../services/TicketServices/ShowTicketService", () => mockShowTicketService);

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowTicketService.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  it("should mark ticket messages as read and verify the WhatsApp session when sendSeen fails", async () => {
    const sendSeenError = new Error("Session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketUpdate = jest.fn();
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = {
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511988887777"
      },
      update: ticketUpdate
    } as any;

    mockGetTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
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
    expect(ticketUpdate).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511988887777@c.us");
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      30,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });

    consoleError.mockRestore();
  });

  it("should use the group WhatsApp jid when the ticket belongs to a group", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = {
      id: 11,
      tenantId: 21,
      whatsappId: 31,
      channel: "whatsapp",
      isGroup: true,
      contact: {
        number: "120363000000000000"
      },
      update: jest.fn()
    } as any;

    mockGetTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(sendSeen).toHaveBeenCalledWith("120363000000000000@g.us");
    expect(mockStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });
});

export {};
