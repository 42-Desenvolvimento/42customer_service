jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../../models/Message";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import socketEmit from "../../../helpers/socketEmit";

const buildTicket = (overrides: Record<string, any> = {}) => ({
  id: 123,
  tenantId: 45,
  whatsappId: 67,
  channel: "whatsapp",
  isGroup: false,
  contact: {
    number: "5511999999999",
    messengerId: "messenger-contact"
  },
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides
});

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 123,
      unreadMessages: 0
    });
  });

  it("aciona verificação de sessão quando sendSeen falha sem interromper a atualização do ticket", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = buildTicket();

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      67,
      sendSeenError
    );
    expect(ShowTicketService).toHaveBeenCalledWith({ id: 123, tenantId: 45 });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 45,
      type: "ticket:update",
      payload: {
        id: 123,
        unreadMessages: 0
      }
    });

    consoleErrorSpy.mockRestore();
  });
});

export {};
