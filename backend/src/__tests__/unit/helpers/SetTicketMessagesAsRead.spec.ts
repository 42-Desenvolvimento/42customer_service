import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock(
  "../../../services/WbotServices/StartWhatsAppSessionVerify",
  () => ({
    StartWhatsAppSessionVerify: jest.fn()
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

describe("SetTicketMessagesAsRead", () => {
  const messageUpdate = Message.update as jest.Mock;
  const showTicketService = ShowTicketService as jest.Mock;
  const startWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
  const getTicketWbot = GetTicketWbot as jest.Mock;
  const emitTicketUpdate = socketEmit as jest.Mock;

  const buildTicket = () =>
    ({
      id: 123,
      tenantId: 42,
      channel: "whatsapp",
      whatsappId: 7,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    messageUpdate.mockResolvedValue([2]);
    showTicketService.mockResolvedValue({ id: 123, unreadMessages: 0 });
    startWhatsAppSessionVerify.mockResolvedValue(undefined);
    emitTicketUpdate.mockReturnValue(undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marca mensagens locais como lidas, envia seen no WhatsApp e emite atualização do ticket", async () => {
    const ticket = buildTicket();
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    getTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(messageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(showTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(emitTicketUpdate).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });
  });

  it("aciona verificação de sessão quando sendSeen rejeita sem interromper o fluxo do ticket", async () => {
    const ticket = buildTicket();
    const error = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(error);
    getTicketWbot.mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(startWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(showTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(emitTicketUpdate).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 123, unreadMessages: 0 }
    });
  });
});
