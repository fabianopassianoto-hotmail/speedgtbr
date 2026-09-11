export const registrationLinks = {
  whatsapp: "https://chat.whatsapp.com/Jz9Zg4z1q302rXOlaI8KKk",
  instagram: "https://instagram.com/speedgtbr",
  video: "https://www.youtube.com/watch?v=dI8-pXOOAvc",
  simgrid: "https://www.thesimgrid.com/communities/speed-gt-brasil",
  support: "https://speedgtbrasil.pages.dev/apoie/",
};

export const approvalNotice = "A entrada no grupo está sujeita à conferência dos dados do cadastro e à aprovação de um administrador. Sua solicitação poderá ficar na fila de entrada enquanto aguarda essa aprovação.";
export const gt7Ratings = ["S", "A+", "A", "B", "C", "D", "E"] as const;
export const addressFields = [["cep", "CEP"], ["rua", "Rua"], ["numero", "Número"], ["bairro", "Bairro"], ["complemento", "Complemento"], ["cidade", "Cidade"], ["uf", "UF"]] as const;
export const registrationFields = ["nomeCompleto", "whatsapp", "email", "psn", ...addressFields.map(([name]) => name), "classificacaoGt7"] as const;
export type RegistrationValues = Record<(typeof registrationFields)[number], string>;
export const brazilStates = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export function validateRegistration(values: Record<string, string>) {
  if (Object.values(values).some(value => value.length > 500)) return "Um dos campos ultrapassou o tamanho permitido.";
  if ((values.nomeCompleto ?? "").trim().length < 3) return "Informe seu nome completo.";
  if (!/^\d{10,13}$/.test((values.whatsapp ?? "").replace(/\D/g, ""))) return "Informe um telefone válido com DDD.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email ?? "")) return "Informe um e-mail válido.";
  if (!values.psn?.trim()) return "Informe sua ID da PSN.";
  if (!values.cidade?.trim() || !brazilStates.includes(values.uf?.toUpperCase())) return "Informe cidade e UF válidas.";
  if (values.cep && !/^\d{5}-?\d{3}$/.test(values.cep)) return "Informe um CEP válido com oito números.";
  if (!gt7Ratings.includes(values.classificacaoGt7 as typeof gt7Ratings[number])) return "Selecione sua classificação no Gran Turismo 7.";
  return null;
}

export function registrationSummary(values: Record<string, string>) {
  return [
    ["nomeCompleto", "Nome completo", values.nomeCompleto],
    ["whatsapp", "Telefone / WhatsApp", values.whatsapp],
    ["email", "E-mail", values.email],
    ["psn", "ID da PSN", values.psn],
    ["cidade", "Endereço", addressFields.filter(([key]) => values[key]).map(([key, label]) => `${label}: ${values[key]}`).join(" · ")],
    ["classificacaoGt7", "Classificação no GT7", values.classificacaoGt7],
  ];
}

export function welcomeEmailText(name: string) {
  return `Olá, ${name}!\n\nRecebemos seu cadastro na Speed GT Brasil.\n\n${approvalNotice}\n\n1 · Solicite entrada no WhatsApp\n${registrationLinks.whatsapp}\n\n2 · Siga nosso Instagram\n${registrationLinks.instagram}\n\n3 · Prepare seu cadastro no SimGrid\nVocê vai usar o SimGrid nas inscrições dos campeonatos. Não precisa se inscrever em um campeonato agora.\n\nVídeo tutorial: ${registrationLinks.video}\n\nPasso a passo:\n• Se ainda não tiver conta, crie uma no Discord (https://discord.com/register) ou na Steam (https://store.steampowered.com/join/), seguindo as instruções e verificações do serviço escolhido. Não é necessário criar as duas.\n• Abra https://www.thesimgrid.com e escolha Login or Register. Selecione Discord ou Steam, entre com sua conta e autorize a conexão.\n• Complete seu perfil e confira sua ID da PSN, usando a mesma informada no cadastro da Speed GT Brasil.\n• Abra ${registrationLinks.simgrid} e escolha Follow Community para seguir a comunidade.\n• Aguarde as orientações da administração no grupo para se inscrever no campeonato adequado.\n\n4 · Apoie a comunidade (opcional)\n${registrationLinks.support}\nO apoio é voluntário e não é requisito para análise do cadastro.\n\nNos vemos na pista!\nSpeed GT Brasil`;
}
