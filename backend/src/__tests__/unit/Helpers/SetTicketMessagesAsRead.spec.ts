import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

const mockMessageUpdate = Message.update as jest.Mock;
const mockGetTicketWbot = GetTicketWbot as jest.Mock;
const mockSocketEmit = socketEmit as jest.Mock;
const mockGetMessengerBot = getMessengerBot as jest.Mock;
const mockShowTicketService = ShowTicketService as jest.Mock;
const mockStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = (overrides = {}) =>
    ({
      id: 321,
      tenantId: 7,
      whatsappId: 12,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888",
        messengerId: "messenger-contact-id"
      },
      update: jest.fn(),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockShowTicketService.mockResolvedValue({ id: 321, unreadMessages: 0 });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("marks ticket messages as read and emits the reloaded ticket", async () => {
    const ticket = buildTicket();
    const wbot = {
      sendSeen: jest.fn().mockResolvedValue(undefined)
    };
    mockGetTicketWbot.mockResolvedValue(wbot);

    await SetTicketMessagesAsRead(ticket);

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
    expect(wbot.sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: 321,
      tenantId: 7
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: { id: 321, unreadMessages: 0 }
    });
  });

  it("verifies the whatsapp session when sendSeen rejects", async () => {
    const ticket = buildTicket();
    const sendSeenError = new Error("sendSeen failed");
    const wbot = {
      sendSeen: jest.fn().mockRejectedValue(sendSeenError)
    };
    mockGetTicketWbot.mockResolvedValue(wbot);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      12,
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: { id: 321, unreadMessages: 0 }
    });
  });

  it("uses messenger markSeen for messenger tickets", async () => {
    const ticket = buildTicket({ channel: "messenger" });
    const messengerBot = {
      markSeen: jest.fn()
    };
    mockGetMessengerBot.mockReturnValue(messengerBot);

    await SetTicketMessagesAsRead(ticket);

    expect(mockGetMessengerBot).toHaveBeenCalledWith(12);
    expect(messengerBot.markSeen).toHaveBeenCalledWith("messenger-contact-id");
    expect(mockGetTicketWbot).not.toHaveBeenCalled();
  });
});
