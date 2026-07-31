import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

const mockMessageUpdate = Message.update as jest.Mock;
const mockShowTicketService = ShowTicketService as jest.Mock;
const mockStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockGetTicketWbot = GetTicketWbot as jest.Mock;
const mockSocketEmit = socketEmit as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = () =>
    ({
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: true,
      contact: {
        number: "55988887777"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    mockShowTicketService.mockResolvedValue({ id: 10, unreadMessages: 0 });
  });

  it("marks messages read and emits the updated ticket", async () => {
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
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(wbot.sendSeen).toHaveBeenCalledWith("55988887777@g.us");
    expect(mockShowTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });
  });

  it("verifies the WhatsApp session when sendSeen rejects without blocking the ticket update", async () => {
    const ticket = buildTicket();
    const sendSeenError = new Error(
      "Cannot read property 'sendSeen' of undefined"
    );
    const wbot = {
      sendSeen: jest.fn().mockRejectedValue(sendSeenError)
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockGetTicketWbot.mockResolvedValue(wbot);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(mockSocketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 10, unreadMessages: 0 }
    });

    consoleError.mockRestore();
  });
});

export {};
