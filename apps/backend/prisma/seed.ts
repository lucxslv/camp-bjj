import { PrismaClient, DivisionTypeCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding DivisionType...');

  const divisionTypes = [
    { code: 'GI', name: 'Gi', description: 'Competição com kimono (Gi)', isStandard: true },
    { code: 'NO_GI', name: 'No-Gi', description: 'Competição sem kimono (No-Gi)', isStandard: true },
    { code: 'ABSOLUTO', name: 'Absoluto', description: 'Divisão aberta (todas as graduações/pesos)', isStandard: true },
  ];

  for (const dt of divisionTypes) {
    const existing = await prisma.divisionType.findUnique({ where: { code: dt.code } });
    if (!existing) {
      await prisma.divisionType.create({ data: dt });
      console.log(`  ✅ Created: ${dt.code} - ${dt.name}`);
    } else {
      console.log(`  ⏭️  Exists: ${dt.code} - ${dt.name}`);
    }
  }

  console.log('✅ Seeding complete');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });