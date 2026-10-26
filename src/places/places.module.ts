import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPlace } from './saved-place.entity';
import { CreatePlaceDto } from './places.dto';

@Controller('api/v1/places')
export class PlacesController {
  constructor(@InjectRepository(SavedPlace) private readonly repo: Repository<SavedPlace>) {}

  @Get()
  list(@Query('deviceId') deviceId: string) {
    return this.repo.find({ where: { deviceId } });
  }

  @Post()
  create(@Body() dto: CreatePlaceDto) {
    return this.repo.save(this.repo.create(dto));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('deviceId') deviceId: string) {
    await this.repo.delete({ id, deviceId });
    return { deleted: true };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([SavedPlace])],
  controllers: [PlacesController],
})
export class PlacesModule {}
