import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { CategoryAlgorithmService } from './category-algorithm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService, CategoryAlgorithmService],
  exports: [CompetitionsService, CategoryAlgorithmService],
})
export class CompetitionsModule {}