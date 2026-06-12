import { useData } from '../context/DataContext';
import BalancePage from './BalancePage';

function CashBal({ lang }) {
  return <BalancePage lang={lang} type="naqd" title="Naqd pul qoldig'i" color="#1565c0" />;
}
export default CashBal;
