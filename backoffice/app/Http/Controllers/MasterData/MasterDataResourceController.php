<?php

namespace App\Http\Controllers\MasterData;

use App\Http\Controllers\Controller;
use App\Models\BaseUuidModel;
use App\Models\Outlet;
use App\Support\SoftDeleteAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

abstract class MasterDataResourceController extends Controller
{
    /** @var class-string<BaseUuidModel> */
    protected string $modelClass;

    protected ?string $scopeColumn = null;

    protected ?string $codeColumn = null;

    protected ?string $codePrefix = null;

    abstract protected function rules(Request $request, ?string $id = null): array;

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->scopedQuery($request)->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->prepareData($request->validate($this->rules($request)), $request);
        $model = DB::transaction(function () use ($data) {
            $model = new $this->modelClass($data);
            if ($this->codeColumn && $this->codePrefix) {
                $model->{$this->codeColumn} = $this->nextCode();
            }
            $model->save();

            return $model;
        });

        return response()->json(['message' => 'Data berhasil ditambahkan.', 'id' => $model->getKey()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $model = $this->findScoped($request, $id);
        $model->fill($this->prepareData($request->validate($this->rules($request, $id)), $request))->save();

        return response()->json(['message' => 'Data berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $model = $this->findScoped($request, $id);
        SoftDeleteAudit::record($request, $model->getTable(), (object) $model->getAttributes());
        $model->delete();

        return response()->json(['message' => 'Data berhasil dihapus.']);
    }

    protected function prepareData(array $data, Request $request): array
    {
        if ($this->scopeColumn === 'company_id') {
            $data['company_id'] = $request->user()->company_id;
        }
        if ($this->scopeColumn === 'outlet_id') {
            $data['outlet_id'] = $this->outletId($request);
        }

        return $data;
    }

    protected function scopedQuery(Request $request): Builder
    {
        $query = ($this->modelClass)::query();
        if ($this->scopeColumn === 'company_id') {
            return $query->where('company_id', $request->user()->company_id);
        }
        if ($this->scopeColumn === 'outlet_id') {
            $outletId = $request->input('outlet_id', $request->user()->outlet_id);

            return $outletId
                ? $query->where('outlet_id', $this->outletId($request))
                : $query->whereHas('outlet', fn (Builder $outlet) => $outlet->where('company_id', $request->user()->company_id));
        }

        return $query;
    }

    protected function findScoped(Request $request, string $id): BaseUuidModel
    {
        return $this->scopedQuery($request)->findOrFail($id);
    }

    protected function outletId(Request $request): string
    {
        $id = $request->input('outlet_id', $request->user()->outlet_id);
        abort_unless($id, 422, 'Pilih store terlebih dahulu.');
        abort_unless(Outlet::query()->whereKey($id)->where('company_id', $request->user()->company_id)->exists(), 403);

        return $id;
    }

    private function nextCode(): string
    {
        $prefix = $this->codePrefix.'-';
        $last = ($this->modelClass)::withTrashed()->where($this->codeColumn, 'like', $prefix.'%')->pluck($this->codeColumn)
            ->map(fn ($code) => (int) substr($code, strlen($prefix)))->max() ?? 0;

        return $prefix.str_pad((string) ($last + 1), 4, '0', STR_PAD_LEFT);
    }
}
