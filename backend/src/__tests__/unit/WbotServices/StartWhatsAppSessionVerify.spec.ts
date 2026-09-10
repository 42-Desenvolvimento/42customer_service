jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import { initWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("StartWhatsAppSessionVerify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reabre a sessão e emite atualização quando recebe erro de sessão fechada", async () => {
    const whatsapp = {
      id: 20,
      tenantId: 30,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const io = {
      emit: jest.fn()
    };
    const wbot = { id: "wbot-20" };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (getIO as jest.Mock).mockReturnValue(io);
    (initWbot as jest.Mock).mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("Session closed") as any
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(io.emit).toHaveBeenCalledWith(
      `${whatsapp.tenantId}:whatsappSession`,
      {
        action: "update",
        session: whatsapp
      }
    );
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("ignora erros que não indicam sessão desconectada", async () => {
    await StartWhatsAppSessionVerify(
      20,
      new Error("temporary network timeout") as any
    );

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(getIO).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
    expect(wbotMessageListener).not.toHaveBeenCalled();
    expect(wbotMonitor).not.toHaveBeenCalled();
  });
});
