import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
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
jest.mock("../../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

const messageUpdateMock = Message.update as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;
const getMessengerBotMock = getMessengerBot as jest.Mock;
const showTicketServiceMock = ShowTicketService as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

const buildTicket = (overrides: Partial<Ticket> = {}): Ticket =>
  ({
    id: 45,
    tenantId: 7,
    whatsappId: 88,
    channel: "whatsapp",
    isGroup: true,
    contact: {
      number: "551188887777",
      messengerId: "messenger-contact"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as Ticket);

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    messageUpdateMock.mockResolvedValue([1]);
    showTicketServiceMock.mockResolvedValue({ id: 45, unreadMessages: 0 });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marks WhatsApp messages as read and verifies the session when sendSeen rejects", async () => {
    const ticket = buildTicket();
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);

    getTicketWbotMock.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 45,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("551188887777@g.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      88,
      sendSeenError
    );
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 45,
      tenantId: 7
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: { id: 45, unreadMessages: 0 }
    });
  });

  it("uses the Messenger bot to mark messages as seen for messenger tickets", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({
      channel: "messenger",
      isGroup: false
    });

    getMessengerBotMock.mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(getTicketWbotMock).not.toHaveBeenCalled();
    expect(getMessengerBotMock).toHaveBeenCalledWith(88);
    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: { id: 45, unreadMessages: 0 }
    });
  });
});
