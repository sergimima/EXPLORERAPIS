import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './db';

export interface TenantContext {
  userId: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
  };
  tokens: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    network: string;
    isActive: boolean;
  }[];
  activeToken?: {
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    network: string;
    settings?: {
      customBasescanApiKey?: string;
      customEtherscanApiKey?: string;
      customMoralisApiKey?: string;
      customQuiknodeUrl?: string;
      whaleThreshold: string;
    };
  };
  role: string;
}

export async function getTenantContext(
  tokenId?: string
): Promise<TenantContext | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organization: {
        include: {
          tokens: {
            where: { isActive: true },
            select: {
              id: true,
              address: true,
              symbol: true,
              name: true,
              network: true,
              isActive: true
            }
          }
        }
      }
    }
  });

  if (!user?.organization) {
    return null;
  }

  let activeToken = undefined;

  // Si se especifica tokenId, buscar ese token
  if (tokenId) {
    const token = await prisma.token.findFirst({
      where: {
        id: tokenId,
        organizationId: user.organizationId!
      },
      include: {
        settings: true
      }
    });

    if (token) {
      activeToken = {
        id: token.id,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        network: token.network,
        settings: token.settings ? {
          customBasescanApiKey: token.settings.customBasescanApiKey || undefined,
          customEtherscanApiKey: token.settings.customEtherscanApiKey || undefined,
          customMoralisApiKey: token.settings.customMoralisApiKey || undefined,
          customQuiknodeUrl: token.settings.customQuiknodeUrl || undefined,
          whaleThreshold: token.settings.whaleThreshold
        } : undefined
      };
    }
  } else if (user.organization.tokens.length > 0) {
    // Token por defecto: el primero activo
    const defaultToken = await prisma.token.findFirst({
      where: {
        organizationId: user.organizationId!,
        isActive: true
      },
      include: {
        settings: true
      }
    });

    if (defaultToken) {
      activeToken = {
        id: defaultToken.id,
        address: defaultToken.address,
        symbol: defaultToken.symbol,
        name: defaultToken.name,
        decimals: defaultToken.decimals,
        network: defaultToken.network,
        settings: defaultToken.settings ? {
          customBasescanApiKey: defaultToken.settings.customBasescanApiKey || undefined,
          customEtherscanApiKey: defaultToken.settings.customEtherscanApiKey || undefined,
          customMoralisApiKey: defaultToken.settings.customMoralisApiKey || undefined,
          customQuiknodeUrl: defaultToken.settings.customQuiknodeUrl || undefined,
          whaleThreshold: defaultToken.settings.whaleThreshold
        } : undefined
      };
    }
  }

  return {
    userId: user.id,
    organizationId: user.organization.id,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
      ownerId: user.organization.ownerId
    },
    tokens: user.organization.tokens,
    activeToken,
    role: user.role
  };
}

// Helper para obtener API keys (custom o platform defaults)
export function getApiKeys(tenantContext: TenantContext) {
  const settings = tenantContext.activeToken?.settings;

  return {
    basescanApiKey: settings?.customBasescanApiKey ||
                     process.env.NEXT_PUBLIC_BASESCAN_API_KEY ||
                     'YourApiKeyToken',
    etherscanApiKey: settings?.customEtherscanApiKey ||
                      process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
                      'YourApiKeyToken',
    moralisApiKey: settings?.customMoralisApiKey ||
                    process.env.NEXT_PUBLIC_MORALIS_API_KEY,
    quiknodeUrl: settings?.customQuiknodeUrl ||
                  process.env.NEXT_PUBLIC_QUICKNODE_URL ||
                  'https://mainnet.base.org'
  };
}
